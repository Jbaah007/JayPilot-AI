import ResumeUploader from "../../ResumeUploader";

export default function ResumeCenterPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Resume Center</h1>
      <p className="mt-1 mb-6 text-slate-600">
        Upload a PDF or DOCX resume to build your career profile and see resume matches on real jobs.
      </p>
      <ResumeUploader />
    </div>
  );
}
