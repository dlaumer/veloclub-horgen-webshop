import { useSearchParams } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

const BASE_URL = import.meta.env.BASE_URL;

export default function ThankYouPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-background">
      <div className="max-w-lg w-full text-center bg-card shadow-lg p-6 sm:p-8 rounded-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
          {t("thankYouTitle")}
        </h1>

        <p className="text-foreground mb-2">
          {t("thankYouReceived")}
        </p>

        <p className="text-muted-foreground mb-4">
          {t("thankYouEmailSoon")}
        </p>

        {orderId && (
          <p className="text-sm text-muted-foreground break-words mt-2">
            <strong>{t("orderId")}</strong> {orderId}
          </p>
        )}

        <p className="text-sm text-muted-foreground mt-4">
          {t("thankYouContact")}
        </p>

        <a
          href={BASE_URL}
          className="mt-6 sm:mt-8 inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
        >
          {t("continueShopping")}
        </a>
      </div>
    </div>
  );
}
