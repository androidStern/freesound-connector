import type { Metadata } from "next";
export const metadata: Metadata = { title: "Freesound Connector by Song Machines" };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
