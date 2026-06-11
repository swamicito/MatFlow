import { NextResponse } from "next/server";

const SAMPLE = `First Name,Last Name,Email,Phone,Date of Birth,Join Date,Status,Belt,Stripes,Membership Type,Membership Price,Custom Price,Notes
Carlos,Gracie,carlos@example.com,555-201-1001,1985-04-12,2022-01-10,Active,Black,4,Unlimited Adult,189.00,,Founding member
Helio,Gracie,helio@example.com,555-201-1002,1990-09-30,2023-06-01,Active,Brown,2,Unlimited Adult,189.00,149.00,Grandfathered rate
Royce,Gracie,royce@example.com,,1995-12-05,2024-03-15,Trial,White,1,Trial 30-Day,49.00,,
Rickson,Gracie,rickson@example.com,555-201-1003,2000-01-20,2024-08-01,Active,Blue,2,Unlimited Adult,189.00,,
Renzo,Gracie,renzo@example.com,555-201-1004,2002-06-15,2024-10-12,Paused,White,3,Unlimited Adult,189.00,,Going on tour
`;

export function GET() {
  return new NextResponse(SAMPLE, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition":
        'attachment; filename="matflow_sample_import.csv"',
      "cache-control": "public, max-age=3600",
    },
  });
}
