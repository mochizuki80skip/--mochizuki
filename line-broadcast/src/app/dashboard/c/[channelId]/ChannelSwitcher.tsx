"use client";

import { useRouter } from "next/navigation";

type ChannelSummary = { id: string; name: string; color: string };

export function ChannelSwitcher({
  current,
  channels,
}: {
  current: ChannelSummary;
  channels: ChannelSummary[];
}) {
  const router = useRouter();

  if (channels.length <= 1) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: current.color }} />
        <span className="font-medium truncate">{current.name}</span>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: current.color }} />
      <select
        value={current.id}
        onChange={(e) => router.push(`/dashboard/c/${e.target.value}`)}
        className="text-sm font-medium border-none bg-transparent flex-1 truncate focus:outline-none cursor-pointer"
      >
        {channels.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
