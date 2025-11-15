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
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
            <div className="max-w-lg w-full text-center bg-card shadow-lg p-6 sm:p-8 rounded-2xl">
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">Thank you for your order! 🎉</h1>

                {!sid && <p className="text-red-600">No SID provided.</p>}

                {loading && <p>Loading your order…</p>}

                {error && (
                    <p className="text-red-600 mt-4">
                        Something went wrong: {error}
                    </p>
                )}

                {session && (
                    <div className="mt-4 text-left text-foreground">
                        <p className="break-words"><strong>Order ID:</strong> {session.client_reference_id}</p>
                        {session.amount_total && (
                            <p>
                                <strong>Amount:</strong>{" "}
                                CHF {(session.amount_total / 100).toFixed(2)}
                            </p>
                        )}
                        {session.customer_details?.email && (
                            <p className="mt-2 text-sm text-muted-foreground break-words">
                                A confirmation email has been sent to{" "}
                                {session.customer_details.email}.
                            </p>
                        )}
                    </div>
                )}

                <a
                    href="/"
                    className="mt-6 sm:mt-8 inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                >
                    Continue Shopping
                </a>
            </div>
        </div>
    );
}
