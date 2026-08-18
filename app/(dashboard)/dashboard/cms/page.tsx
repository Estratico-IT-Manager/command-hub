import { redirect } from "next/navigation";

export default function CmsIndexPage() {
  redirect("/dashboard/cms/sites");
}