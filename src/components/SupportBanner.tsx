export const MadeWithDyad = () => {
  return (
    <div className="p-8 pb-12 text-center flex flex-col items-center gap-4">
      <div className="flex items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
        <a
          href="https://buymeacoffee.com/danielebuatti"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-500 transition-colors"
        >
          Support Development
        </a>
        <div className="h-1 w-1 rounded-full bg-slate-500" />
        <a
          href="https://www.dyad.sh/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-indigo-500 transition-colors"
        >
          Made with Dyad
        </a>
      </div>
    </div>
  );
};