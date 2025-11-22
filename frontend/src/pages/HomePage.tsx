import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bed, 
  Calendar, 
  DollarSign, 
  BarChart3, 
  Shield, 
  Zap, 
  Users, 
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles
} from 'lucide-react';

export default function HomePage() {
  const navigate = useNavigate();
  
  // Ensure home page always renders - no auth checks here
  React.useEffect(() => {
    console.log('HomePage mounted - route:', window.location.pathname);
    console.log('HomePage - localStorage auth-storage:', localStorage.getItem('auth-storage'));
    
    // Prevent any navigation away from home page unless user clicks a button
    const currentPath = window.location.pathname;
    if (currentPath !== '/' && currentPath !== '/login') {
      console.warn('Unexpected path change detected:', currentPath);
    }
  }, []);

  const features = [
    {
      icon: Calendar,
      title: 'Reservation Management',
      description: 'Streamline bookings, check-ins, and check-outs with an intuitive calendar interface.'
    },
    {
      icon: Bed,
      title: 'Room Management',
      description: 'Track room status, availability, and maintenance in real-time across your property.'
    },
    {
      icon: DollarSign,
      title: 'Financial Management',
      description: 'Handle payments, invoices, and financial reporting all in one place.'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Get insights into occupancy rates, revenue, and performance metrics.'
    },
    {
      icon: Users,
      title: 'Multi-Property Support',
      description: 'Manage multiple properties and tenants from a single dashboard.'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with role-based access control and audit trails.'
    }
  ];

  const benefits = [
    'Increase operational efficiency by 40%',
    'Reduce manual errors and paperwork',
    'Real-time inventory and availability tracking',
    'Automated billing and payment processing',
    'Comprehensive reporting and analytics',
    'Mobile-responsive design for on-the-go access'
  ];

  const stats = [
    { value: '99.9%', label: 'Uptime', icon: Shield },
    { value: '50+', label: 'Hotels Using', icon: Users },
    { value: '24/7', label: 'Support', icon: Clock },
    { value: '40%', label: 'Efficiency Gain', icon: TrendingUp }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      {/* Navigation */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        zIndex: 1000,
        padding: '1.25rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            background: '#000000',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: '700',
            fontSize: '1.375rem',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            I
          </div>
          <span style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: '#000000'
          }}>
            InnSight
          </span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '0.625rem 1.5rem',
              background: 'transparent',
              border: '1px solid rgba(0, 0, 0, 0.2)',
              color: '#000000',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: '600',
              transition: 'all 0.2s',
              borderRadius: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#000000';
              e.currentTarget.style.color = '#ffffff';
              e.currentTarget.style.borderColor = '#000000';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = '#000000';
              e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.2)';
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '0.625rem 1.5rem',
              background: '#000000',
              border: 'none',
              borderRadius: '10px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9375rem',
              fontWeight: '600',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
              position: 'relative',
              overflow: 'hidden'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.2)';
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        paddingTop: '140px',
        paddingBottom: '100px',
        background: '#ffffff',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Subtle decorative elements */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '10%',
          width: '300px',
          height: '300px',
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.03) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '10%',
          width: '200px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(0, 0, 0, 0.02) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }} />
        
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            textAlign: 'center',
            maxWidth: '900px',
            margin: '0 auto'
          }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1.25rem',
              background: '#000000',
              borderRadius: '50px',
              marginBottom: '2rem'
            }}>
              <Sparkles style={{ width: '16px', height: '16px', color: '#ffffff' }} />
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ffffff' }}>
                Trusted by 50+ hotels worldwide
              </span>
            </div>
            <h1 style={{
              fontSize: 'clamp(3rem, 6vw, 5.5rem)',
              fontWeight: '800',
              marginBottom: '1.5rem',
              lineHeight: '1.1',
              color: '#000000',
              letterSpacing: '-0.03em'
            }}>
              Transform Your Hotel Operations
            </h1>
            <p style={{
              fontSize: 'clamp(1.125rem, 2vw, 1.375rem)',
              marginBottom: '2.5rem',
              color: '#4a4a4a',
              lineHeight: '1.7',
              maxWidth: '700px',
              margin: '0 auto 2.5rem',
              fontWeight: '400'
            }}>
              The all-in-one Property Management System designed to streamline your hotel operations, 
              boost revenue, and delight your guests.
            </p>
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  padding: '1rem 2.5rem',
                  background: '#000000',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '1.0625rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
                }}
              >
                Start Free Trial
                <ArrowRight style={{ width: '20px', height: '20px' }} />
              </button>
              <button
                onClick={() => {
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                }}
                style={{
                  padding: '1rem 2.5rem',
                  background: '#ffffff',
                  color: '#000000',
                  border: '2px solid #000000',
                  borderRadius: '12px',
                  fontSize: '1.0625rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#000000';
                  e.currentTarget.style.color = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.color = '#000000';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={{
        padding: '5rem 2rem',
        background: '#fafafa'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '2rem'
        }}>
          {stats.map((stat, index) => (
            <div
              key={index}
              style={{
                textAlign: 'center',
                padding: '2.5rem 2rem',
                background: '#ffffff',
                borderRadius: '20px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px)';
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)';
              }}
            >
              <div style={{
                display: 'inline-flex',
                padding: '1rem',
                background: '#000000',
                borderRadius: '14px',
                marginBottom: '1.25rem'
              }}>
                <stat.icon style={{ width: '24px', height: '24px', color: '#ffffff' }} />
              </div>
              <div style={{
                fontSize: '3rem',
                fontWeight: '800',
                color: '#000000',
                marginBottom: '0.5rem',
                lineHeight: '1'
              }}>
                {stat.value}
              </div>
              <div style={{
                fontSize: '1rem',
                color: '#666666',
                fontWeight: '600'
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={{
        padding: '6rem 2rem',
        background: '#ffffff'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            textAlign: 'center',
            marginBottom: '4rem'
          }}>
            <h2 style={{
              fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
              fontWeight: '800',
              color: '#000000',
              marginBottom: '1rem',
              letterSpacing: '-0.02em',
              lineHeight: '1.2'
            }}>
              Everything You Need to Run Your Hotel
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#666666',
              maxWidth: '600px',
              margin: '0 auto',
              lineHeight: '1.6'
            }}>
              Powerful features designed to simplify your operations and boost your bottom line.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '2rem'
          }}>
            {features.map((feature, index) => (
              <div
                key={index}
                style={{
                  padding: '2.5rem',
                  background: '#fafafa',
                  borderRadius: '20px',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.12)';
                  e.currentTarget.style.background = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.06)';
                  e.currentTarget.style.background = '#fafafa';
                }}
              >
                <div style={{
                  width: '64px',
                  height: '64px',
                  background: '#000000',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <feature.icon style={{ width: '28px', height: '28px', color: '#ffffff' }} />
                </div>
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#000000',
                  marginBottom: '0.75rem',
                  lineHeight: '1.3'
                }}>
                  {feature.title}
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#666666',
                  lineHeight: '1.7'
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section style={{
        padding: '6rem 2rem',
        background: '#fafafa',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '4rem',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: 'clamp(2.25rem, 4vw, 3.5rem)',
              fontWeight: '800',
              marginBottom: '1.5rem',
              lineHeight: '1.2',
              color: '#000000',
              letterSpacing: '-0.02em'
            }}>
              Why Choose InnSight?
            </h2>
            <p style={{
              fontSize: '1.25rem',
              color: '#666666',
              marginBottom: '2rem',
              lineHeight: '1.7'
            }}>
              Join hundreds of hotels that trust InnSight to power their operations and deliver exceptional guest experiences.
            </p>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: '#000000',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}>
                    <CheckCircle2 style={{ width: '18px', height: '18px', color: '#ffffff' }} />
                  </div>
                  <span style={{ fontSize: '1.0625rem', color: '#000000', fontWeight: '500' }}>{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{
            background: '#000000',
            borderRadius: '24px',
            padding: '3rem',
            color: '#ffffff',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
          }}>
            <div style={{
              fontSize: '5rem',
              fontWeight: '800',
              color: '#ffffff',
              marginBottom: '1rem',
              lineHeight: '1'
            }}>
              40%
            </div>
            <div style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
              color: '#ffffff'
            }}>
              Average Efficiency Increase
            </div>
            <p style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.8)',
              lineHeight: '1.7'
            }}>
              Hotels using InnSight report significant improvements in operational efficiency, 
              reduced errors, and increased guest satisfaction.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '6rem 2rem',
        background: '#ffffff'
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center',
          padding: '5rem 4rem',
          background: '#fafafa',
          borderRadius: '32px',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#000000',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 2rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
          }}>
            <Zap style={{ width: '40px', height: '40px', color: '#ffffff' }} />
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: '800',
            color: '#000000',
            marginBottom: '1rem',
            letterSpacing: '-0.02em',
            lineHeight: '1.2'
          }}>
            Ready to Transform Your Hotel?
          </h2>
          <p style={{
            fontSize: '1.25rem',
            color: '#666666',
            marginBottom: '2.5rem',
            lineHeight: '1.7'
          }}>
            Start your free trial today and see how InnSight can revolutionize your hotel operations.
            No credit card required.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '1.25rem 3rem',
              background: '#000000',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '1.125rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 12px 28px rgba(0, 0, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.25)';
            }}
          >
            Get Started Free
            <ArrowRight style={{ width: '24px', height: '24px' }} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '4rem 2rem 2rem',
        background: '#000000',
        color: '#ffffff'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.5rem'
            }}>
              <div style={{
                width: '44px',
                height: '44px',
                background: '#ffffff',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
                fontWeight: '700',
                fontSize: '1.375rem'
              }}>
                I
              </div>
              <span style={{ 
                fontSize: '1.5rem', 
                fontWeight: '700',
                color: '#ffffff'
              }}>
                InnSight
              </span>
            </div>
            <p style={{ fontSize: '0.9375rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.6' }}>
              The modern Property Management System for hotels of all sizes.
            </p>
          </div>
          <div>
            <h4 style={{ color: '#ffffff', fontWeight: '700', marginBottom: '1rem', fontSize: '1rem' }}>
              Product
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a href="#features" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Features
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Pricing
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Security
              </a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#ffffff', fontWeight: '700', marginBottom: '1rem', fontSize: '1rem' }}>
              Company
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                About
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Blog
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Contact
              </a>
            </div>
          </div>
          <div>
            <h4 style={{ color: '#ffffff', fontWeight: '700', marginBottom: '1rem', fontSize: '1rem' }}>
              Support
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Documentation
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Help Center
              </a>
              <a href="#" style={{ color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', fontSize: '0.9375rem', transition: 'color 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'}>
                Status
              </a>
            </div>
          </div>
        </div>
        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          paddingTop: '2rem',
          textAlign: 'center',
          fontSize: '0.9375rem',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          © {new Date().getFullYear()} InnSight. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
