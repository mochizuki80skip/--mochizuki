import { createClient } from "@/lib/supabase/server";
import { TrainerProfileForm } from "./trainer-profile-form";

export const dynamic = "force-dynamic";

export default async function TrainerProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: trainer } = await supabase
    .from("trainers")
    .select(
      "id, display_name, personality_memo, characteristic_phrases, signature_emoji"
    )
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">トレーナー設定</h1>
        <p className="text-sm text-gray-600 mt-1">
          ここに登録した個性が AI に伝わり、あなたらしい口調で返信案を出すようになります。
        </p>
      </div>
      <TrainerProfileForm
        userId={user?.id ?? ""}
        userEmail={user?.email ?? ""}
        initial={trainer ?? null}
      />
    </div>
  );
}
