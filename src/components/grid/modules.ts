// Registers AG Grid Enterprise (with Integrated Charts on AG Charts Community) and the licence key, once for every grid.
import { AgChartsCommunityModule } from "ag-charts-community";
import { AllEnterpriseModule, LicenseManager, ModuleRegistry } from "ag-grid-enterprise";

ModuleRegistry.registerModules([AllEnterpriseModule.with(AgChartsCommunityModule)]);
if (process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY) LicenseManager.setLicenseKey(process.env.NEXT_PUBLIC_AG_GRID_LICENSE_KEY);
