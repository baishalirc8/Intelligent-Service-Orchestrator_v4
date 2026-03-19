import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Bot, Radar } from "lucide-react";
import NetworkOpsDiscovery from "./network-ops-discovery";
import NetworkOpsAgents from "./network-ops-agents";

export default function InfrastructureConfigure() {
  return (
    <div className="h-full overflow-auto scrollbar-thin">
      <Tabs defaultValue="credentials" className="h-full flex flex-col">
        <div className="px-6 pt-4 pb-0">
          <TabsList className="bg-muted/30">
            <TabsTrigger value="credentials" className="text-xs gap-1.5" data-testid="tab-credentials">
              <Key className="h-3 w-3" />
              Credentials & Probes
            </TabsTrigger>
            <TabsTrigger value="agents" className="text-xs gap-1.5" data-testid="tab-agent-assignment">
              <Bot className="h-3 w-3" />
              AI Agent Assignment
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="credentials" className="flex-1 overflow-hidden m-0">
          <NetworkOpsDiscovery />
        </TabsContent>
        <TabsContent value="agents" className="flex-1 overflow-hidden m-0">
          <NetworkOpsAgents />
        </TabsContent>
      </Tabs>
    </div>
  );
}
