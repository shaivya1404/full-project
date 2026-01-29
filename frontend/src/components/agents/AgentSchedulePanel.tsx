import { Calendar as CalendarIcon, Clock, Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AgentSchedule } from '../../types';
import { Button } from '../Button';

type AgentSchedulePanelProps = {
  schedule: AgentSchedule[];
  onRemoveShift: (shiftId: string) => void;
};

export const AgentSchedulePanel = ({
  schedule,
  onRemoveShift,
}: AgentSchedulePanelProps) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const getShiftsForDay = (dayIndex: number) => {
    return schedule.filter((s) => s.dayOfWeek === dayIndex);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
          <CalendarIcon size={20} className="mr-2 text-primary" />
          Weekly Schedule
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm">
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-medium px-2">Oct 27 - Nov 2, 2025</span>
          <Button variant="secondary" size="sm">
            <ChevronRight size={16} />
          </Button>
          <Button size="sm" className="ml-2">
            <Plus size={16} className="mr-1" /> Add Shift
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {days.map((day, index) => {
          const dayShifts = getShiftsForDay(index);
          const isToday = new Date().getDay() === index;

          return (
            <div key={day} className={`p-4 flex flex-col md:flex-row md:items-center ${isToday ? 'bg-primary/5' : ''}`}>
              <div className="w-32 mb-2 md:mb-0">
                <p className={`font-semibold ${isToday ? 'text-primary' : 'text-gray-900 dark:text-white'}`}>
                  {day}
                  {isToday && <span className="ml-2 text-[10px] bg-primary text-white px-1.5 py-0.5 rounded-full uppercase">Today</span>}
                </p>
              </div>
              <div className="flex-1 flex flex-wrap gap-2">
                {dayShifts.length === 0 ? (
                  <span className="text-sm text-gray-400 italic">No shifts scheduled</span>
                ) : (
                  dayShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm shadow-sm"
                    >
                      <Clock size={14} className="text-primary" />
                      <span className="font-medium">{shift.startTime} - {shift.endTime}</span>
                      <span className="text-xs text-gray-500 uppercase">{shift.shiftType || 'regular'}</span>
                      <button
                        onClick={() => onRemoveShift(shift.id)}
                        className="ml-2 p-1 text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 md:mt-0 md:ml-4">
                <Button variant="secondary" size="sm" className="h-8 w-8 !p-0">
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
