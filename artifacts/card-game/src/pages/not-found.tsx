export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-serif text-primary">404</h1>
        <p className="text-xl font-serif italic text-muted-foreground">La carta che cerchi non è nel mazzo.</p>
        <a href="/" className="inline-block mt-8 px-6 py-2 border border-primary text-primary rounded-md hover:bg-primary/10 transition-colors">
          Torna al tavolo
        </a>
      </div>
    </div>
  );
}
