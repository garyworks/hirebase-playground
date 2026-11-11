import { operations } from "../lib/catalog";

export function ApiKey({ name }: { name: string }) {
  return <code className="api-key">{name}</code>;
}

export function ApiOperation({ id }: { id: string }) {
  const operation = operations.find((entry) => entry.id === id);
  if (!operation) return null;
  return (
    <span className="api-operation">
      <a href={operation.docs} target="_blank" rel="noreferrer">
        {operation.name}
      </a>
      <code>
        {operation.method} {operation.path}
      </code>
    </span>
  );
}
