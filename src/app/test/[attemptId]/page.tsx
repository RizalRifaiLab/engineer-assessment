import { TestRunner } from "@/components/TestRunner";

export default async function TestPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  return <TestRunner attemptId={attemptId} />;
}
