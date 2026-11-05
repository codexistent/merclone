const INPUT_RATE = 16000; // Gemini expects 16 kHz input
const OUTPUT_RATE = 24000; // Gemini always returns 24 kHz
const SAMPLES_PER_CHUNK = 640; // 40 ms at 16 kHz

// script - turn raw audio from mic into 40 ms chunks of 16-bit ints for Gemini
const WORKLET_SOURCE = `
class PcmCapture extends AudioWorkletProcessor {
    buffer = new Int16Array(${SAMPLES_PER_CHUNK});
    length = 0;
    
    process(inputs){
        const samples = inputs[0]?.[0];
        if(!samples)return true;

        for(const sample of samples){
            const clamped = Math.max(-1, Math.min(1, sample));
            this.buffer[this.length++] = clamped * 32767;
            if(this.length==this.buffer.length){
                this.port.postMessage(this.buffer.slice().buffer);
                this.length = 0;
            }
        }
        
        return true;
    }
}
registerProcessor("pcm-capture", PcmCapture);
`;

// creates level meter/audio wave/blob as user speaks
function createLevelMeter(analyser: AnalyserNode){
    analyser.fftSize = 512;
    const data = new Uint8Array(analyser.fftSize);

    return () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for(const value of data) {
            const sample = (value - 128)/128;
            sum += sample * sample;
        }
        return Math.min(1, Math.sqrt(sum/data.length)*3.2);
    };
}

export class Microphone{
    private ctx = new AudioContext({ sampleRate: INPUT_RATE });
    private stream: MediaStream | null = null;
    level: () => number = () => 0; // volume function

    // initiate access to audio stream, which arrives in chunks
    async start(onChunk: (pcm: ArrayBuffer) => void){
        // ask mic for permission
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true,
            autoGainControl: true },
        });

        // pass worklet script to browser
        const url = URL.createObjectURL(
            new Blob([WORKLET_SOURCE], { type: "application/javascript" }),
        );
        await this.ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        // stream -> chunk -> onChunk() processes it
        const source = this.ctx.createMediaStreamSource(this.stream);
        const capture = new AudioWorkletNode(this.ctx, "pcm-capture");
        capture.port.onmessage = (event) => onChunk(event.data);

        const analyser = this.ctx.createAnalyser(); // used for interviewee orb
        this.level = createLevelMeter(analyser);
        source.connect(analyser);

        const mute = this.ctx.createGain();
        mute.gain.value = 0;
        source.connect(capture).connect(mute).connect(this.ctx.destination);

        await this.ctx.resume();
    }

    stop() {
        this.stream?.getTracks().forEach((track) => track.stop());
        this.ctx.close().catch(() => {});
    }
}

export class Speaker{
    private ctx = new AudioContext({ sampleRate: OUTPUT_RATE });
    private analyser = this.ctx.createAnalyser(); // used for interviewer orb
    private playing = new Set<AudioBufferSourceNode>();
    private nextStart = 0;
    level = createLevelMeter(this.analyser);

    constructor() {
        this.analyser.connect(this.ctx.destination);
    }

    resume() {
        return this.ctx.resume();
    }
    
    play(pcm: ArrayBuffer){
        const int16 = new Int16Array(pcm);
        if(int16.length === 0) return;

        const buffer = this.ctx.createBuffer(1, int16.length, OUTPUT_RATE);
        buffer.getChannelData(0).set(Float32Array.from(int16, (sample) => sample / 32768));

        // play audio once
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.analyser); // route
        source.onended = () => this.playing.delete(source);

        // start next chunk with slight delay before previous one
        const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextStart);
        source.start(startAt);
        this.nextStart = startAt + buffer.duration;
        this.playing.add(source);
    }

    interrupt() {
        this.playing.forEach((source) => source.stop());
        this.playing.clear();
        this.nextStart = 0;
    }

    stop() {
        this.interrupt();
        this.ctx.close().catch(() => {});
    }
}