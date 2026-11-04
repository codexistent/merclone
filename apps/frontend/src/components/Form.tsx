import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";

export function Form() {
  const [github, setGithub] = useState("");
  // const [linkedin, setLinkedin] = useState("");

  const navigate = useNavigate();

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

    // post github and linkedin info for api to fetch
    const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
      // linkedin,
      github,
    });

    navigate(`/interview/${response.data.id}`);
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
        <div className="flex justify-center p-4">
          <Button onClick={onSubmit}>Start Interview</Button>
        </div>
      </div>
    </div>
  );
}
