import Playground from "@/components/playground";
export const dynamic = "force-dynamic";
export default function Home() {
  return (
    <Playground
      configured={Boolean(process.env.HIREBASE_API_KEY?.trim())}
      ownerMode={
        !process.env.RAILWAY_PUBLIC_DOMAIN?.trim() &&
        process.env.HIREBASE_OWNER_MODE === "true"
      }
    />
  );
}
