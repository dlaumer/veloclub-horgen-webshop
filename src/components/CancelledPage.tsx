import { useSearchParams } from "react-router-dom";

export default function CancelledPage() {
  const [searchParams] = useSearchParams();
  // In case you ever want to inspect / log something, e.g. sid or reason:
  const sid = searchParams.get("sid");
  const reason = searchParams.get("reason");

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="max-w-lg w-full text-center bg-white shadow-lg p-8 rounded-2xl">
        <h1 className="text-3xl font-bold mb-4 text-red-600">
          Payment cancelled
        </h1>

        <p className="mb-2">
          Your payment was <strong>not completed</strong>, so no order was placed.
        </p>

        <p className="text-sm text-gray-500 mb-6">
          You can go back to the shop and try again whenever you’re ready.
        </p>

        {reason && (
          <p className="text-xs text-gray-400 mb-4">
            (Reason: {reason})
          </p>
        )}

        {/* Optional: show sid if you pass it back from Stripe, otherwise remove this block */}
        {sid && (
          <p className="text-xs text-gray-400 mb-4">
            Session: {sid}
          </p>
        )}

        <a
          href="/"
          className="mt-4 inline-block bg-black text-white px-6 py-3 rounded-xl"
        >
          Back to Shop
        </a>
      </div>
    </div>
  );
}
