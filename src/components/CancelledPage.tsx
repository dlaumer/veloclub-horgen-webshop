import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
const BASE_URL = import.meta.env.BASE_URL;

export default function CancelledPage() {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const sid = searchParams.get("sid");
    const reason = searchParams.get("reason");

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
            <div className="max-w-lg w-full text-center bg-card shadow-lg p-6 sm:p-8 rounded-2xl">
                <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-destructive">
                    {t('paymentCancelled')}
                </h1>

                <p className="mb-2 text-foreground">
                    {t('paymentNotCompleted')}
                </p>

                <p className="text-sm text-muted-foreground mb-6">
                    {t('tryAgainLater')}
                </p>

                {reason && (
                    <p className="text-xs text-muted-foreground mb-4">
                        ({t('reason')} {reason})
                    </p>
                )}

                {sid && (
                    <p className="text-xs text-muted-foreground mb-4 break-words">
                        {t('session')} {sid}
                    </p>
                )}

                <a
                    href={BASE_URL}
                    className="mt-4 inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
                >
                    {t('backToShop')}
                </a>
            </div>
        </div>
    );
}
