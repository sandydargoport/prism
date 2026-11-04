import { SetupWizard } from '../SetupWizard';

export const metadata = {
  title: 'Setup Wizard — Prism',
};

export default function RerunSetupPage() {
  return <SetupWizard firstRun={false} />;
}
