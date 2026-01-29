import { Calendar, Clock, Play, AlertCircle } from 'lucide-react';
import type { Campaign } from '../../types';
import { Card } from '../Card';
import { Button } from '../index';

type CampaignSchedulerProps = {
  campaign: Campaign;
  onStartManual?: () => void;
};

export const CampaignScheduler = ({
  campaign,
  onStartManual,
}: CampaignSchedulerProps) => {
  const { operatingHours } = campaign;

  if (!operatingHours) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-800">
        <Calendar size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Schedule Configured</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
          This campaign doesn't have operating hours set. It will run continuously unless manually paused.
        </p>
      </div>
    );
  }

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <Clock className="mr-2 text-blue-500" size={20} />
              Operating Hours
            </h3>
            <span className="text-sm font-medium px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {operatingHours.timezone}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Daily Window</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {operatingHours.startTime} — {operatingHours.endTime}
                </p>
              </div>
              <Calendar className="text-gray-400" size={32} />
            </div>

            <div className="grid grid-cols-7 gap-2">
              {days.map((day) => (
                <div 
                  key={day} 
                  className={`p-3 text-center rounded-lg border ${
                    ['Sat', 'Sun'].includes(day) 
                      ? 'border-gray-200 dark:border-gray-700 text-gray-400' 
                      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  }`}
                >
                  <p className="text-xs font-bold uppercase">{day}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manual Control</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Force start the campaign outside of scheduled hours. This will ignore operating hour restrictions for 1 hour.
          </p>
          <Button 
            variant="primary" 
            className="w-full" 
            onClick={onStartManual}
            disabled={campaign.status === 'active'}
          >
            <Play size={18} className="mr-2" />
            Manual Trigger
          </Button>

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-500 shrink-0" />
            <p className="text-xs text-yellow-700 dark:text-yellow-400">
              Warning: Making calls outside of standard business hours may violate local regulations in some regions.
            </p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Execution Status</h3>
        <div className="relative pt-1">
          <div className="flex mb-2 items-center justify-between">
            <div>
              <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                In Progress
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs font-semibold inline-block text-blue-600">
                {campaign.callsMade && campaign.contactsCount 
                  ? Math.round((campaign.callsMade / campaign.contactsCount) * 100) 
                  : 0}%
              </span>
            </div>
          </div>
          <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-200">
            <div 
              style={{ width: `${campaign.callsMade && campaign.contactsCount ? (campaign.callsMade / campaign.contactsCount) * 100 : 0}%` }} 
              className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{campaign.callsMade || 0} calls made</span>
            <span>{campaign.contactsCount || 0} total contacts</span>
          </div>
        </div>
      </Card>
    </div>
  );
};
