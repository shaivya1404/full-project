import { useState } from 'react';
import type { Call, CallFilter, CallStatus, Sentiment } from '../types';
import { DashboardLayout, Card, Input, Button } from '../components';
import { 
  CallHistoryTable, 
  CallDetailsPanel, 
  AnalyticsCards, 
  AnalyticsChart, 
  RealTimeWidget 
} from '../components/dashboard';
import { useCalls, useCallStats } from '../api/calls';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const DashboardPage = () => {
  const [filter, setFilter] = useState<CallFilter>({
    page: 1,
    limit: 10,
    search: '',
  });
  
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const { data: callsData, isLoading: callsLoading } = useCalls(filter);
  const { data: statsData, isLoading: statsLoading } = useCallStats();

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(prev => ({ ...prev, search: e.target.value, page: 1 }));
  };

  const handleStatusFilter = (status: string) => {
     setFilter(prev => ({ 
        ...prev, 
        status: status === 'all' ? undefined : status as CallStatus, 
        page: 1 
     }));
  };

  const handleSentimentFilter = (sentiment: string) => {
    setFilter(prev => ({ 
        ...prev, 
        sentiment: sentiment === 'all' ? undefined : sentiment as Sentiment, 
        page: 1 
     }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Call Operations</h1>
           <p className="text-gray-600 dark:text-gray-400">Monitor and manage call center performance</p>
        </div>

        {/* Analytics Section */}
        <AnalyticsCards stats={statsData} isLoading={statsLoading} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2">
              <AnalyticsChart data={statsData?.callVolumeHistory} isLoading={statsLoading} />
           </div>
           <div>
              <RealTimeWidget />
           </div>
        </div>

        {/* Filters and Table */}
        <Card>
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
             <div className="relative w-full sm:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input 
                  placeholder="Search by caller, agent..." 
                  value={filter.search || ''}
                  onChange={handleSearch}
                  className="pl-10"
                />
             </div>
             <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                <select 
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white outline-none"
                  onChange={(e) => handleStatusFilter(e.target.value)}
                  value={filter.status || 'all'}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="missed">Missed</option>
                </select>
                
                 <select 
                  className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white outline-none"
                  onChange={(e) => handleSentimentFilter(e.target.value)}
                  value={filter.sentiment || 'all'}
                >
                  <option value="all">All Sentiment</option>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="negative">Negative</option>
                </select>
             </div>
          </div>
          
          <CallHistoryTable 
            calls={callsData?.data || []} 
            isLoading={callsLoading}
            onSelectCall={setSelectedCall}
          />
          
          {/* Pagination */}
          {callsData && callsData.total > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
               <span className="text-sm text-gray-700 dark:text-gray-400">
                  Page {callsData.page} of {Math.ceil(callsData.total / callsData.limit)}
               </span>
               <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={callsData.page === 1}
                    onClick={() => setFilter(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    <ChevronLeft size={16} /> Previous
                  </Button>
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    disabled={callsData.page * callsData.limit >= callsData.total}
                    onClick={() => setFilter(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    Next <ChevronRight size={16} />
                  </Button>
               </div>
            </div>
          )}
        </Card>
      </div>

      <CallDetailsPanel 
        call={selectedCall} 
        onClose={() => setSelectedCall(null)} 
      />
    </DashboardLayout>
  );
};
