import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Filter, X } from "lucide-react";

interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
  className?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear,
  className = ""
}) => {

  const hasActiveFilter = startDate || endDate;

  return (
    <Card className={`shadow-soft border-0 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2 text-sm">
          <Calendar className="w-4 h-4 text-[#0c2c8a]" />
          <span>Date Range Filter</span>
          {hasActiveFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="ml-auto h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Custom Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate" className="text-sm font-medium">
              Start Date
            </Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endDate" className="text-sm font-medium">
              End Date
            </Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full"
            />
          </div>
        </div>

        {/* Active Filter Display */}
        {hasActiveFilter && (
          <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-md border border-blue-200">
            <Filter className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-800">
              {startDate && endDate
                ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                : startDate
                ? `From ${new Date(startDate).toLocaleDateString()}`
                : `Until ${new Date(endDate).toLocaleDateString()}`}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DateRangeFilter;
