export type FlowStep = {
  title: string;
  description?: string;
};

export type FlowDiagramProps = {
  steps: FlowStep[];
  caption?: string;
};

export function FlowDiagram({ steps, caption }: FlowDiagramProps) {
  return (
    <div className="flow-diagram-wrap">
      {/* デスクトップ: 横並び */}
      <div className="flow-horizontal">
        {steps.map((step, i) => (
          <div key={i} className="flow-step-group">
            <div className="flow-step">
              <span className="flow-number">{i + 1}</span>
              <div className="flow-card">
                <p className="flow-title">{step.title}</p>
                {step.description && (
                  <p className="flow-desc">{step.description}</p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flow-arrow-h">
                <svg width="28" height="20" viewBox="0 0 28 20" fill="none">
                  <path d="M0 10h22M18 4l8 6-8 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* モバイル: 縦並び */}
      <div className="flow-vertical">
        {steps.map((step, i) => (
          <div key={i} className="flow-v-group">
            <div className="flow-v-step">
              <span className="flow-number">{i + 1}</span>
              <div className="flow-card">
                <p className="flow-title">{step.title}</p>
                {step.description && (
                  <p className="flow-desc">{step.description}</p>
                )}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flow-arrow-v">
                <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
                  <path d="M10 0v18M4 14l6 8 6-8" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {caption && <p className="flow-caption">{caption}</p>}
    </div>
  );
}
