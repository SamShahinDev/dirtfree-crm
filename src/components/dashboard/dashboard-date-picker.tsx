'use client';

import * as React from "react";
import { Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardDatePickerProps {
  onDateChange?: (range: string) => void;
  className?: string;
}

export function DashboardDatePicker({
  onDateChange,
  className
}: DashboardDatePickerProps = {}) {
  const [selectedRange, setSelectedRange] = React.useState("7d");

  const handleRangeChange = (value: string) => {
    console.log('Date range changing to:', value);
    setSelectedRange(value);
    onDateChange?.(value);
  };

  React.useEffect(() => {
    console.log('DashboardDatePicker mounted');
  }, []);

  return (
    <div className="relative z-20">
      <Select value={selectedRange} onValueChange={handleRangeChange}>
        <SelectTrigger
          className="w-[180px] relative z-10 cursor-pointer"
          onClick={() => console.log('Select trigger clicked!')}
        >
          <Calendar className="mr-2 h-4 w-4 pointer-events-none" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-50">
          <SelectItem value="7d">Last 7 days</SelectItem>
          <SelectItem value="14d">Last 14 days</SelectItem>
          <SelectItem value="30d">Last 30 days</SelectItem>
          <SelectItem value="90d">Last 3 months</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}