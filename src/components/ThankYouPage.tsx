import { fetchCheckoutSession } from "@/lib/stockApi";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function ThankYouPage() {
    const [searchParams] = useSearchParams();
    const sid = searchParams.get("sid");

    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sid) {
            setError("No session ID provided.");
            setLoading(false);
            return;
        }
        fetchCheckoutSession(sid)
            .then((data) => {
                console.log("Fetched session data:", data);
                setSession(data)
                setLoading(false)
            })
            .catch((err) => {
                setError(err.message);
                setLoading(false);
            });
    }, [sid]);

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
            <div className="max-w-lg w-full text-center bg-white shadow-lg p-8 rounded-2xl">
                <h1 className="text-3xl font-bold mb-4">Thank you for your order! 🎉</h1>

                {!sid && <p className="text-red-600">No SID provided.</p>}

                {loading && <p>Loading your order…</p>}

                {error && (
                    <p className="text-red-600 mt-4">
                        Something went wrong: {error}
                    </p>
                )}

                {session && (
                    <div className="mt-4 text-left">
                        <p><strong>Order ID:</strong> {session.client_reference_id}</p>
                        {session.amount_total && (
                            <p>
                                <strong>Amount:</strong>{" "}
                                CHF {(session.amount_total / 100).toFixed(2)}
                            </p>
                        )}
                        {session.customer_details?.email && (
                            <p className="mt-2 text-sm text-gray-500">
                                A confirmation email has been sent to{" "}
                                {session.customer_details.email}.
                            </p>
                        )}
                    </div>
                )}

                <a
                    href="/"
                    className="mt-8 inline-block bg-black text-white px-6 py-3 rounded-xl"
                >
                    Continue Shopping
                </a>
            </div>
        </div>
    );
}
