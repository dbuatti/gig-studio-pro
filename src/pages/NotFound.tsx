import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-3">Error 404</p>
        <h1 className="text-4xl font-black uppercase tracking-tight text-foreground mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-2">
          We couldn't find anything at <code className="font-mono text-sm break-all text-foreground">{location.pathname}</code>.
        </p>
        <Button asChild className="mt-6 bg-indigo-600 hover:bg-indigo-700 font-black uppercase tracking-widest text-[10px] h-11 px-6 rounded-xl">
          <Link to="/">Return to home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
