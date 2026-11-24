import { loadConfig } from "../../lib/config";
import { SettingsForm } from "../../components/Phase5";
export const dynamic = "force-dynamic";
export default function Settings() { const { version, ...cfg } = loadConfig(); return <><h1 className="mb-4 text-2xl">Settings</h1><SettingsForm cfg={cfg} version={version} /></>; }
