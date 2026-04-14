import { getInterviewMovies } from "@/lib/recommendationService";
import { OnboardingClient } from "@/components/onboarding-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const interviewMovies = await getInterviewMovies(12);
  return <OnboardingClient interviewMovies={interviewMovies} />;
}
