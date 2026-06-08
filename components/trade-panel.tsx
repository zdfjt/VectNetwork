"use client"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { SwapPanel } from "@/components/swap-panel"
import { OptionsPanel } from "@/components/options-panel"

export function TradePanel() {
  return (
    <Tabs defaultValue="swap" className="flex h-full flex-col">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="swap">Swap</TabsTrigger>
        <TabsTrigger value="options">Options</TabsTrigger>
      </TabsList>
      <TabsContent value="swap" className="mt-3 min-h-0 flex-1">
        <SwapPanel />
      </TabsContent>
      <TabsContent value="options" className="mt-3 min-h-0 flex-1">
        <OptionsPanel />
      </TabsContent>
    </Tabs>
  )
}
