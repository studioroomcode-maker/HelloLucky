Pod::Spec.new do |s|
  s.name           = 'JourneyVideo'
  s.version        = '1.0.0'
  s.summary        = 'Frame-by-frame MP4 writer for the journey video'
  s.description    = 'Frame-by-frame MP4 writer for the journey video'
  s.license        = 'MIT'
  s.author         = 'studioroom'
  s.homepage       = 'https://helloluck.studioroomkr.com'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
