import Link from "next/link";
import IntakeForm from "../../components/IntakeForm";

export default function Add() {
  return (<>
    <Link href="/" className="inline-flex min-h-11 items-center text-sm text-cobalt">Back to board</Link>
    <h1 className="mt-1 text-2xl md:text-3xl">Add an application</h1>
    <p className="mb-5 mt-1 text-sm text-muted">Upload the deck and the form. The app checks the numbers, stage and portfolio overlap straight away, then scores it when a model is connected.</p>
    <IntakeForm />
  </>);
}
