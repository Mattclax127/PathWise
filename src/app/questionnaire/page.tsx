import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/OnboardingWizard";
import { createClient } from "@/lib/supabase/server";
import { firstUnansweredKey } from "@/lib/engine/onboarding";
import { loadAnswers } from "./actions";

export const metadata = { title: "Your answers | PathWise" };

export default async function QuestionnairePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { answers, stepKey, hasJourney } = await loadAnswers(supabase, user.id);
  // resume where they left off; a complete set of answers opens the review screen
  const start = stepKey ?? firstUnansweredKey(answers) ?? "review";
  return (
    <div className="wrap" style={{ padding: "32px 20px", maxWidth: 680 }}>
      <OnboardingWizard initialAnswers={answers} initialStep={start} hasJourney={hasJourney} />
    </div>
  );
}
