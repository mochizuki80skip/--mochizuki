import Link from "next/link";

type Props = {
  patientId: string;
  recentCount: number;
};

/**
 * Staff visit-record button. Links to the dedicated multi-select calendar
 * page where staff can edit any past visit dates in batch.
 */
export default function RecordVisitButton({ patientId, recentCount }: Props) {
  return (
    <Link
      href={`/admin/patients/${patientId}/visits`}
      className="block w-full text-center rounded-full border-2 border-sky-500 bg-white text-sky-700 font-bold text-sm py-2.5 hover:bg-sky-50 transition"
    >
      📅 来院記録 ({recentCount})
    </Link>
  );
}
