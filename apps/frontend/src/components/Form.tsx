import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";
import { useEffect } from "react";

export function Form() {
  const [github, setGithub] = useState("");
  // const [linkedin, setLinkedin] = useState("");

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // wake up backend while user types
  useEffect(() => { axios.get(`${BACKEND_URL}/health`).catch(() => {}); }, []);

  async function onSubmit() {
    if (!github /* || !linkedin*/) {
      // TODO: add more validation here
      if (!github) {
        toast("Please provide a valid GitHub URL.", {
          action: {
            label: "Ok",
            onClick: () => console.log("User acknowledged toast."),
          },
        });
      }
      // if (!linkedin) {
      //   toast("Please provide a valid LinkedIn URL.", {
      //     action: {
      //       label: "Ok",
      //       onClick: () => console.log("User acknowledged toast."),
      //     },
      //   });
      // }
      return;
    }

    setLoading(true);

    try {
      // post github and linkedin info for api to fetch
      const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
        github,
      });
      
      navigate(`/interview/${response.data.id}`);
    } catch(error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message
        : undefined;

      toast(message ?? "Could not start interview.");
      setLoading(false);
    }
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <div>
        <h2 className="scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">
          Start Your Interview
        </h2>
        {/* <div className="p-2">
          <Input
            placeholder="LinkedIn URL"
            onChange={(e) => setLinkedin(e.target.value)}
          />
        </div> */}
        <div className="p-2">
          <Input
            placeholder="GitHub URL"
            onChange={(e) => setGithub(e.target.value)}
          />
        </div>
        <div className="flex flex-col items-center p-4">
          <Button disabled={loading} onClick={onSubmit} className="!mb-0">
            {loading ? "Starting Interview..." : "Start Interview"}
          </Button>
          <p className="!m-0 !mt-2.5 !leading-none text-xs text-gray-500">
            {loading ? "This may take up to a minute." : "Enter GitHub URL, then hit 'Start Interview'."}
          </p>
        </div>
      </div>
    </div>
  );
}
