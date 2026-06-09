interface PageContentProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContent({ children, className = "" }: PageContentProps) {
  return (
    <div className={`mx-auto max-w-6xl space-y-6 px-6 py-8 md:px-8 ${className}`}>
      {children}
    </div>
  );
}
