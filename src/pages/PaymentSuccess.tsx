import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { CheckCircle, Mail } from "lucide-react";
import logo from "@/assets/logo.png";

const PaymentSuccess = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_hsl(var(--beige))_0%,_hsl(var(--beige-dark)/0.3)_100%)]" />

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
          className="mx-auto w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
        >
          <CheckCircle className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </motion.div>

        <div className="space-y-2">
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            Η πληρωμή σου ολοκληρώθηκε!
          </h1>
          <p className="font-sans text-sm text-muted-foreground">Payment Successful</p>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card rounded-2xl border border-border/50 p-6 space-y-4 card-inset"
        >
          <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" strokeWidth={1.5} />
          </div>
          <div className="space-y-1.5">
            <p className="font-sans text-sm text-foreground font-medium">
              Έλεγξε το email σου
            </p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              Θα λάβεις οδηγίες σύνδεσης στο email που δήλωσες.
            </p>
            <p className="font-sans text-xs text-muted-foreground leading-relaxed">
              Check your inbox for login instructions.
            </p>
          </div>
        </motion.div>

        <button
          onClick={() => navigate("/auth?mode=login")}
          className="shimmer-gold flex w-full items-center justify-center rounded-2xl bg-primary py-4 font-sans text-sm font-semibold text-primary-foreground transition-all duration-200 hover:opacity-90 shadow-gold-md"
        >
          Σύνδεση / Sign In
        </button>
      </motion.div>
    </div>
  );
};

export default PaymentSuccess;
