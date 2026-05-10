export function Footer() {
  return (
    <footer className="mt-auto py-4 px-6 border-t border-slate-800 bg-slate-950">
      <p className="text-xs text-slate-500 text-center max-w-3xl mx-auto">
        This platform provides market-cap ladder trend analysis based on SEBI/AMFI categorisation data.
        It is <strong className="text-slate-400">not investment advice</strong>, stock recommendation, or valuation analysis.
        Data sourced from AMFI half-yearly Large/Mid/Small Cap categorisation files.
      </p>
    </footer>
  );
}
