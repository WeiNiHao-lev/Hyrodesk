import { redirect } from "next/navigation";

/** The project list is the home page: every piece of work starts inside a project. */
export default function Home() {
  redirect("/projects");
}
