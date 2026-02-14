import { useEffect, useState } from "react";
import { Card } from "../Card";
import { Activity, Wifi, WifiOff } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import clsx from "clsx";

interface ActiveCallUpdate {
  activeCalls: number;
  waitingCalls: number;
  systemStatus: "operational" | "degraded" | "maintenance";
}

export const RealTimeWidget = () => {
  const [data, setData] = useState<ActiveCallUpdate>({
    activeCalls: 0,
    waitingCalls: 0,
    systemStatus: "operational",
  });
  const [connected, setConnected] = useState(false);
  const token = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    if (!token) return;

    const baseUrl =
      import.meta.env.VITE_API_BASE_URL || "/api";
    // Using a fake URL that won't actually work without a backend,
    // but demonstrating the integration point.
    const eventSource = new EventSource(
      `${baseUrl}/calls/stream?token=${token}`
    );

    eventSource.onopen = () => setConnected(true);

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setData(payload);
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  return (
    <Card className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Activity className="text-primary" />
          Live Monitor
        </h3>
        <div className="flex items-center gap-2 text-xs">
          {connected ? (
            <span className="flex items-center text-green-600 gap-1">
              <Wifi size={14} /> Live
            </span>
          ) : (
            <span className="flex items-center text-gray-400 gap-1">
              <WifiOff size={14} /> Offline
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
            {data.activeCalls}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-300 uppercase tracking-wide font-semibold mt-1">
            Active Calls
          </div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg text-center">
          <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
            {data.waitingCalls}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-300 uppercase tracking-wide font-semibold mt-1">
            In Queue
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">System Status</span>
          <span
            className={clsx("font-medium px-2 py-0.5 rounded-full text-xs", {
              "bg-green-100 text-green-700":
                data.systemStatus === "operational",
              "bg-yellow-100 text-yellow-700": data.systemStatus === "degraded",
              "bg-gray-100 text-gray-700": data.systemStatus === "maintenance",
            })}
          >
            {data.systemStatus.toUpperCase()}
          </span>
        </div>
      </div>
    </Card>
  );
};
