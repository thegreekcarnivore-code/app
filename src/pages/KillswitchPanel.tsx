import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Power,
  StopCircle, 
  Play,
  Pause,
  AlertTriangle,
  Shield,
  Activity,
  Settings
} from 'lucide-react';

interface KillswitchState {
  enabled: boolean;
  description: string;
  blocks_operation: boolean;
}

interface KillswitchStatus {
  killswitches: {[key: string]: KillswitchState};
  safe_to_operate: boolean;
  automation_active: boolean;
}

export default function KillswitchPanel() {
  const [killswitchStatus, setKillswitchStatus] = useState<KillswitchStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadKillswitchStatus();
    // Refresh every 5 seconds
    const interval = setInterval(loadKillswitchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadKillswitchStatus = async () => {
    try {
      const response = await fetch('/api/killswitches');
      if (response.ok) {
        const data = await response.json();
        setKillswitchStatus(data);
        setError(null);
      } else {
        throw new Error('Failed to load killswitch status');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
  };

  const toggleKillswitch = async (name: string, enabled: boolean) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/killswitches/${name}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enabled})
      });

      if (response.ok) {
        await loadKillswitchStatus(); // Refresh status
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update killswitch');
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    }
    setLoading(false);
  };

  const emergencyStop = async () => {
    if (!confirm('EMERGENCY STOP: This will immediately halt ALL automation. Continue?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/emergency-stop', {method: 'POST'});
      if (response.ok) {
        await loadKillswitchStatus();
      } else {
        throw new Error('Emergency stop failed');
      }
    } catch (err) {
      setError(`Emergency stop error: ${err.message}`);
    }
    setLoading(false);
  };

  const safeStart = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/safe-start', {method: 'POST'});
      if (response.ok) {
        await loadKillswitchStatus();
      } else {
        throw new Error('Safe start failed');
      }
    } catch (err) {
      setError(`Safe start error: ${err.message}`);
    }
    setLoading(false);
  };

  const enableMaster = async () => {
    if (!confirm('Enable FULL automation? Content will be generated automatically (still requires your approval).')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/enable-master', {method: 'POST'});
      if (response.ok) {
        await loadKillswitchStatus();
      } else {
        throw new Error('Enable master failed');
      }
    } catch (err) {
      setError(`Enable master error: ${err.message}`);
    }
    setLoading(false);
  };

  const disableAll = async () => {
    if (!confirm('Disable ALL automation? This is a safe shutdown.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/disable-all', {method: 'POST'});
      if (response.ok) {
        await loadKillswitchStatus();
      } else {
        throw new Error('Disable all failed');
      }
    } catch (err) {
      setError(`Disable all error: ${err.message}`);
    }
    setLoading(false);
  };

  if (!killswitchStatus) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Activity className="w-4 h-4 mr-2 animate-spin" />
            Loading safety controls...
          </div>
        </CardContent>
      </Card>
    );
  }

  const isEmergencyActive = killswitchStatus.killswitches.emergency?.enabled;
  const isMasterEnabled = killswitchStatus.killswitches.master?.enabled;

  return (
    <div className="space-y-4">
      {/* Emergency Status */}
      {isEmergencyActive && (
        <Alert className="border-red-500 bg-red-50">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="font-medium">
            🚨 EMERGENCY STOP IS ACTIVE - All automation is halted
          </AlertDescription>
        </Alert>
      )}

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Safety Control Panel
          </CardTitle>
          <CardDescription>
            Multiple killswitches for safe automation control
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {/* Overall Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div>
                <span className="font-medium">System Status:</span>
                <Badge 
                  variant={killswitchStatus.automation_active ? "default" : "secondary"}
                  className="ml-2"
                >
                  {killswitchStatus.automation_active ? "AUTOMATION ACTIVE" : "AUTOMATION OFF"}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                {killswitchStatus.safe_to_operate ? (
                  <Badge variant="outline" className="text-green-600">Safe to Operate</Badge>
                ) : (
                  <Badge variant="destructive">Not Safe</Badge>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid md:grid-cols-4 gap-2">
              <Button 
                onClick={safeStart}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                <Play className="w-4 h-4 mr-2" />
                Safe Start
              </Button>
              
              <Button 
                onClick={enableMaster}
                disabled={loading || isEmergencyActive}
                variant={isMasterEnabled ? "secondary" : "default"}
              >
                <Power className="w-4 h-4 mr-2" />
                {isMasterEnabled ? "Master ON" : "Enable Master"}
              </Button>
              
              <Button 
                onClick={disableAll}
                disabled={loading}
                variant="outline"
              >
                <Pause className="w-4 h-4 mr-2" />
                Disable All
              </Button>
              
              <Button 
                onClick={emergencyStop}
                disabled={loading}
                variant="destructive"
              >
                <StopCircle className="w-4 h-4 mr-2" />
                EMERGENCY
              </Button>
            </div>

            {/* Individual Killswitches */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Individual Controls:</Label>
              
              {Object.entries(killswitchStatus.killswitches).map(([name, state]) => (
                <div key={name} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <Label className="text-sm font-medium capitalize">{name.replace('_', ' ')}</Label>
                    <p className="text-xs text-muted-foreground">{state.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={state.blocks_operation ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {state.blocks_operation ? "BLOCKING" : "ALLOWING"}
                    </Badge>
                    <Switch
                      checked={name === "master" ? state.enabled : !state.enabled}
                      onCheckedChange={(checked) => {
                        const newState = name === "master" ? checked : !checked;
                        toggleKillswitch(name, newState);
                      }}
                      disabled={loading || (isEmergencyActive && name !== "emergency")}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safety Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Safety Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div><strong>Safe Start:</strong> Enables learning and API, keeps automation OFF</div>
          <div><strong>Enable Master:</strong> Starts content generation (still requires approval)</div>
          <div><strong>Disable All:</strong> Safe shutdown of all automation</div>
          <div><strong>Emergency Stop:</strong> Immediate halt of everything (use if something goes wrong)</div>
          <div className="text-xs text-muted-foreground mt-3">
            💡 Individual killswitches give granular control over specific features
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert className="border-red-500">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}