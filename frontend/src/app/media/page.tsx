import UploadSection from "@/components/dashboard/UploadSection";

export default function MediaProcessingPage() {
  return (
    <div className="max-w-4xl mx-auto pb-12">
      <header className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Media Processing</h1>
        <p className="text-white/50">Upload and ingest media into your AuraOS vector database.</p>
      </header>
      <UploadSection />
    </div>
  );
}
