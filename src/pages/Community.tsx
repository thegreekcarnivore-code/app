import { useLanguage } from "@/context/LanguageContext";
import GroupFeed from "@/components/community/GroupFeed";

const Community = () => {
  const { lang } = useLanguage();

  return (
    <div className="space-y-4 px-1 pt-14 pb-24">
      <section className="rounded-[2rem] border border-border/70 bg-[linear-gradient(135deg,hsl(var(--beige))_0%,hsl(var(--background))_100%)] p-4 shadow-sm">
        <div className="space-y-2">
          <p className="font-sans text-xs font-semibold uppercase tracking-[0.24em] text-gold">
            {lang === "el" ? "Κοινότητα" : "Community"}
          </p>
          <h1 className="font-serif text-2xl font-semibold text-foreground">
            {lang === "el" ? "Μείνε κοντά στην ομάδα" : "Stay close to the group"}
          </h1>
          <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
            {lang === "el"
              ? "Η κοινότητα λειτουργεί ως επίπεδο υποστήριξης γύρω από το coaching σου. Μπες όταν χρειάζεσαι ώθηση, ιδέες ή αίσθηση ότι προχωράς μαζί με άλλους."
              : "Community is a support layer around your coaching. Drop in when you need momentum, ideas, or the feeling that you are moving forward alongside others."}
          </p>
        </div>
      </section>

      <GroupFeed />
    </div>
  );
};

export default Community;
