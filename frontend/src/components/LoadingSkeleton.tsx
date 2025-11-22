export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ background: 'white', borderRadius: '8px', padding: '1rem' }}>
      <div style={{ display: 'grid', gap: '1rem' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, 1fr)`,
              gap: '1rem',
            }}
          >
            {Array.from({ length: columns }).map((_, j) => (
              <div
                key={j}
                style={{
                  height: '20px',
                  background: '#e2e8f0',
                  borderRadius: '4px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
}

export function CardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              height: '120px',
              background: '#e2e8f0',
              borderRadius: '6px',
              marginBottom: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div
              style={{
                height: '16px',
                background: '#e2e8f0',
                borderRadius: '4px',
                width: '60%',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <div
              style={{
                height: '16px',
                background: '#e2e8f0',
                borderRadius: '4px',
                width: '40%',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      ))}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div
            style={{
              height: '16px',
              background: '#e2e8f0',
              borderRadius: '4px',
              width: '60%',
              marginBottom: '1rem',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: '32px',
              background: '#e2e8f0',
              borderRadius: '4px',
              width: '80%',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.5;
            }
          }
        `}
      </style>
    </div>
  );
}

