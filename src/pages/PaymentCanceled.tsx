import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { XCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const PaymentCanceled = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)] dark:[background-image:none]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-sm text-center space-y-8 relative z-10"
      >
        <img src={logo} alt="The Greek Carnivore" className="mx-auto h-20 w-auto object-contain" />

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 15 }}
          className="mx-auto w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center"
        >
          <XCircle className="w-10 h-10 text-destructive" strokeWidth={1.5} />
        </motion.div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Η πληρωμή ακυρώθηκε
          </h1>
          <p className="font-sans text-sm text-muted-foreground">Payment was canceled</p>
        </div>

        <p className="font-sans text-xs text-muted-foreground leading-relaxed">
          Δεν έγινε καμία χρέωση. Μπορείς να δοκιμάσεις ξανά όποτε θέλεις.
        </p>

        <button
          onClick={() => navigate("/")}
          className="flex w-full items-center justify-center rounded-2xl border border-primary/30 bg-card py-4 font-sans text-sm font-medium text-foreground transition-all duration-200 hover:bg-primary/5 hover:border-primary/50"
        >
          Επιστροφή / Go Back
        </button>
      </motion.div>
    </div>
  );
};

export default PaymentCanceled;
