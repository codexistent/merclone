# Background

Mercor is a company whose business consists of two primary parts: an AI interviewer and data labeling. For their former product, there are two primary stakeholders:

- Talent
  - Select form a list of jobs
  - Upload their resume and join interview
  - Complete interview with AI; this is authomatically recorded and graded
- Recruiters/Companies
  - Click into each job listing
  - View candidates' recorded interviews

The implementation, however, is not as trivial as it may seem from the surface. The primary challenges for implementation are as follows:

1. Parsing the users experience, i.e. processing their resume, scraping the links from their resume
2. Post-start interview process. The first four below (a-d) are hard components for building a voice agent, minus the video
   a. Text to Speech, TTS. The step that is least expensive to run out of steps a-c.
   b. WebRTC for real-time web browser communication
   c. Speech to Text, STT. Typically cheaper than TTS.
   d. Small language Model, SLM for reasoning about user responses. A larger model would have more latency which would not be ideal.
   e. For adding video for interviewer, you'd need to add real-time video generation model. Less of these--or at least, quality open-source ones--currently exist compared to TTS and STT models, and otherwise non-self hosted models are typically very expensive (i.e. 5x more than for steps a-d).

## Voice Agent Architectures

There are three primary approaches for building a voice agent.

### Approach 1: Cascaded pipeline

Advantages:

- cheaper
- more flexible

Tradeoffs:

- slower

Architecture diagram:
![readme/cascadedpipeline.png](readme/cascadedpipeline.png)

Here, Vaal is a service which strips the raw audio of external noise (i.e. dogs barking, toilet flushing in the background).

Other tools that may be used throughout this process:

- LiveKit SDK, a popular library for voice agents which don't necessarily host the LLMs themselves, but let you select/switch fluidly between them. If you don't use this library, you'd just need to build the inference layer yourself.
