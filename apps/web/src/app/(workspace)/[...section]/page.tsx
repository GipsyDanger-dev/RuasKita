import { notFound } from "next/navigation";
import Shell from "@/components/workspace/shell";
import PublicShell from "@/components/workspace/public-shell";
import WorkspacePage from "@/components/workspace/pages";

const routes = [
  "dashboard",
  "map",
  "scan",
  "roads",
  "incidents",
  "repairs",
  "ruasview",
  "analytics",
  "reports",
  "contributors",
  "system",
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  if (
    !routes.includes(section[0]) ||
    section.length > 2 ||
    (section.length === 2 && !["incidents", "reports"].includes(section[0]))
  )
    notFound();
  const query = await searchParams;
  const filter = Object.fromEntries(
    Object.entries(query).map(([key, value]) => [
      key,
      typeof value === "string" ? value : "",
    ]),
  );
  const isPublicRoute = ["map", "incidents", "scan"].includes(section[0]);
  const page = (
    <WorkspacePage
      section={section[0]}
      id={section[1]}
      filter={filter}
      publicView={isPublicRoute}
    />
  );
  return (
    isPublicRoute ? <PublicShell>{page}</PublicShell> : <Shell>{page}</Shell>
  );
}
