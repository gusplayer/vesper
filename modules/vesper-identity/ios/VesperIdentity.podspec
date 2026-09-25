# A local Expo module (ADR-0048): autolinking finds this podspec under modules/ and
# `pod install` adds it. No package.json, so the fields the remote template reads from
# one are written here.
Pod::Spec.new do |s|
  s.name           = 'VesperIdentity'
  s.version        = '0.1.0'
  s.summary        = 'The Vesper identity in a synchronizable Keychain item (iCloud Keychain).'
  s.description    = 'The Vesper identity in a synchronizable Keychain item (iCloud Keychain).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,swift}"
end
