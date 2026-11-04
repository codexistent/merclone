import { useState } from "react";
import "../styles/globals.css";
import { Form } from "./components/Form";
import { Interview } from "./components/Interview";
import { Result } from "./components/Result";
import { Toaster } from "@/components/ui/sonner";

export function App() {
  // stores what state page should be in
  // TODO: use React router instead
  const [page, setPage] = useState<"form" | "interview" | "result">("form");

  return (
    <div>
      {page == "form" && <Form />}
      {page == "interview" && <Interview />}
      {page == "result" && <Result />}
      <Toaster position="top-right" />
    </div>
  );
}

export default App;
