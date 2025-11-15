import { fetchCheckoutSession } from "@/lib/stockApi";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
const BASE_URL = import.meta.env.BASE_URL;

export default function ThankYouPage() {
    const { t } = useTranslation();
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
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">{t('thankYouTitle')}</h1>

                {!sid && <p className="text-destructive">{t('noSessionId')}</p>}

                {loading && <p>{t('loading')}</p>}

                {error && (
                    <p className="text-destructive mt-4">
                        {t('somethingWentWrong')} {error}
                    </p>
                )}

                {session && (
                    <div className="mt-4 text-left text-foreground">
                        <p className="break-words"><strong>{t('orderId')}</strong> {session.client_reference_id}</p>
                        {session.amount_total && (
                            <p>
                                <strong>{t('amountLabel')}</strong>{" "}
                                CHF {(session.amount_total / 100).toFixed(2)}
                            </p>
                        )}
                        {session.customer_details?.email && (
                            <p className="mt-2 text-sm text-muted-foreground break-words">
                                {t('confirmationEmailSent')}{" "}
                                {session.customer_details.email}.
                            </p>
                        )}
                    </div>
                )}

                <a
                    href={BASE_URL}
                    className="mt-6 sm:mt-8 inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                >
                    {t('continueShopping')}
                </a>
            </div>
        </div>
    );
}
