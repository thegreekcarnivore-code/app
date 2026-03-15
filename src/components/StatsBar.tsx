const StatsBar = () => {
  const stats = [
    { value: "500+", label: "Μεταμορφώσεις" },
    { value: "-10 κιλά", label: "Μέσος Όρος / 3 μήνες" },
    { value: "⚡", label: "Γρήγορα Αποτελέσματα" },
  ];

  return (
    <section className="border-y border-border/50 bg-card py-10">
      <div className="container mx-auto flex flex-col items-center justify-center gap-8 px-4 sm:flex-row sm:gap-16">
        {stats.map((stat, i) => (
          <div key={i} className="text-center">
            <p className="font-serif text-4xl font-bold text-gold md:text-5xl">{stat.value}</p>
            <p className="mt-1 font-sans text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default StatsBar;
